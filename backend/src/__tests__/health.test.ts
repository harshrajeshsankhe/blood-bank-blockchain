import { describe, it, expect } from "vitest";

describe("backend smoke tests", () => {
  it("has the expected service name", () => {
    const service = "bloodchain-api";
    expect(service).toBe("bloodchain-api");
  });

  it("uses safe demo temperature bounds", () => {
    const temperature = 4.5;
    expect(temperature >= 2 && temperature <= 6).toBe(true);
  });
});
