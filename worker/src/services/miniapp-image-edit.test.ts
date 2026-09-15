import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { editMiniAppImage } from "./miniapp-image-edit";

const token = "123456:test-token";
const encoder = new TextEncoder();
async function authorization() {
  const values = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAEAAAE",
    user: JSON.stringify({ id: 42, first_name: "Анна" }),
  };
  const params = new URLSearchParams(values);
  const data = Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    ),
    encoder.encode(token),
  );
  const hash = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        secret,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      encoder.encode(data),
    ),
  );
  params.set(
    "hash",
    [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
  return `tma ${params}`;
}
function env() {
  return { TELEGRAM_BOT_TOKEN: token, OPENAI_API_KEY: "openai-key" } as Env;
}
async function request(
  instruction: string | null = "Сделай фон светлее",
  image: File | null = new File(["image"], "photo.jpg", { type: "image/jpeg" }),
) {
  const body = new FormData();
  if (image) body.set("image", image);
  if (instruction !== null) body.set("instruction", instruction);
  return new Request("https://example.test/api/miniapp/ai/image/edit", {
    method: "POST",
    headers: { authorization: await authorization() },
    body,
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("Mini App image editing", () => {
  it("authenticates, sends the source image as multipart input, and returns a no-store image", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ b64_json: "AQID" }] }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await editMiniAppImage(await request(), env());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const provider = init.body as FormData;
    expect(provider.get("image")).toBeInstanceOf(File);
    expect(provider.get("prompt") as string).toContain(
      "ИНСТРУКЦИЯ ПОЛЬЗОВАТЕЛЯ:\nСделай фон светлее",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
  });
  it("rejects missing Telegram authorization before contacting OpenAI", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = await request();
    req.headers.delete("authorization");
    await expect(editMiniAppImage(req, env())).rejects.toMatchObject({
      code: "MINIAPP_AUTH_REQUIRED",
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    ["missing image", () => request("instruction", null), "AI_IMAGE_REQUIRED"],
    [
      "empty instruction",
      () => request("   "),
      "AI_IMAGE_INSTRUCTION_REQUIRED",
    ],
    [
      "unsupported image",
      () =>
        request("instruction", new File(["x"], "x.gif", { type: "image/gif" })),
      "INVALID_IMAGE_TYPE",
    ],
    [
      "long instruction",
      () => request("x".repeat(2001)),
      "AI_IMAGE_INSTRUCTION_TOO_LONG",
    ],
  ])("validates %s", async (_name, makeRequest, code) => {
    await expect(
      editMiniAppImage(await makeRequest(), env()),
    ).rejects.toMatchObject({ code });
  });
});
