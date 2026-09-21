import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // `vinext start` does not inject Cloudflare asset bindings. Its local
    // fallback still validates the compiled app; preview/deployment uses the
    // Cloudflare binding supplied by the Vite/Sites runtime.
    if (!env?.ASSETS) {
      return handler.fetch(request, env as Env, ctx);
    }

    if (url.pathname === "/" || url.pathname === "/helix") {
      return env.ASSETS.fetch(new Request(new URL("/helix.html", request.url), request));
    }

    if (url.pathname.startsWith("/static/")) {
      const assetPath = url.pathname.replace(/^\/static/, "") || "/helix.html";
      return env.ASSETS.fetch(new Request(new URL(assetPath, request.url), request));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: path => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
