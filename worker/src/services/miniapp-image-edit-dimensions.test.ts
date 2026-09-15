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

async function request() {
  const body = new FormData();
  body.set("image", new File(["image"], "photo.jpg", { type: "image/jpeg" }));
  body.set("instruction", "Сделай фон светлее");
  return new Request("https://example.test/api/miniapp/ai/image/edit", {
    method: "POST",
    headers: { authorization: await authorization() },
    body,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("Mini App image edit dimensions", () => {
  it("requests a provider size close to the source ratio and returns the exact source dimensions", async () => {
    const transform = vi.fn();
    const output = vi.fn();
    const responseOptions = vi.fn();
    const handle: any = {
      transform(options: unknown) {
        transform(options);
        return handle;
      },
      async output(options: unknown) {
        output(options);
        return {
          response(options?: { headers?: HeadersInit }) {
            responseOptions(options);
            return new Response(new Uint8Array([9, 8, 7]), {
              headers: {
                "content-type": "image/png",
                ...(options?.headers || {}),
              },
            });
          },
        };
      },
    };
    const imageTransform = {
      info: vi.fn().mockResolvedValue({ width: 1080, height: 608 }),
      input: vi.fn().mockReturnValue(handle),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "AQID" }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      TELEGRAM_BOT_TOKEN: token,
      OPENAI_API_KEY: "openai-key",
      IMAGE_TRANSFORM: imageTransform,
    } as unknown as Env;
    const response = await editMiniAppImage(await request(), env);
    const provider = fetchMock.mock.calls[0]?.[1]?.body as FormData;

    expect(imageTransform.info).toHaveBeenCalledTimes(1);
    expect(provider.get("size")).toBe("1088x608");
    expect(transform).toHaveBeenCalledWith({
      width: 1080,
      height: 608,
      fit: "cover",
    });
    expect(output).toHaveBeenCalledWith({ format: "image/png" });
    expect(responseOptions).toHaveBeenCalledWith({
      headers: {
        "cache-control": "no-store",
        "content-disposition": 'inline; filename="edited-image.png"',
      },
    });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails locally when source dimensions cannot be decoded", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const imageTransform = {
      info: vi.fn().mockRejectedValue(new Error("decode failed")),
      input: vi.fn(),
    };
    const env = {
      TELEGRAM_BOT_TOKEN: token,
      OPENAI_API_KEY: "openai-key",
      IMAGE_TRANSFORM: imageTransform,
    } as unknown as Env;

    await expect(editMiniAppImage(await request(), env)).rejects.toMatchObject({
      code: "INVALID_IMAGE_DATA",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(imageTransform.input).not.toHaveBeenCalled();
  });
});
