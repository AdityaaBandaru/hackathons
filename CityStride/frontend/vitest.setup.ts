import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./src/test/server";

// A jsdom canvas is not implemented; ECharts falls back gracefully, but
// silence the console noise it produces trying to measure text.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
