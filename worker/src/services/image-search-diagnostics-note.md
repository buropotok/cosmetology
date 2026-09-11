# Image search diagnostics

For the official-image search flow, full Gemini prompts are intentionally logged for production diagnosis. This is an explicit diagnostic exception approved for this flow; secrets, authorization headers, Telegram init data, and API keys must never be logged.
