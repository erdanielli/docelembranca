import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// React Testing Library only auto-registers its cleanup when the test
// framework's globals are injected. This project runs vitest with
// `globals: false` (explicit imports), so the unmount has to be wired by hand —
// without it every render stacks onto the previous test's DOM and queries start
// finding duplicates.
afterEach(() => {
  cleanup();
});
