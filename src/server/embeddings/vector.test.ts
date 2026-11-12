import { describe, expect, it } from "vitest";
import { average, normalize, parseVector, toVectorLiteral } from "./vector";

const length = (vector: number[]) => Math.hypot(...vector);

describe("normalize", () => {
  it("scales a vector to unit length, keeping its direction", () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(length(normalize([1, 2, 3, 4, 5]))).toBeCloseTo(1, 12);
  });

  it("leaves a unit vector as it is", () => {
    expect(normalize([0, 1, 0])).toEqual([0, 1, 0]);
  });

  it("keeps negative components negative", () => {
    expect(normalize([-3, 0, 4])).toEqual([-0.6, 0, 0.8]);
  });

  it("rejects the zero vector, which has no direction", () => {
    expect(() => normalize([0, 0, 0])).toThrow();
  });

  it("rejects non-finite numbers", () => {
    expect(() => normalize([1, Number.NaN])).toThrow();
    expect(() => normalize([1, Number.POSITIVE_INFINITY])).toThrow();
  });
});

describe("average", () => {
  it("is the normalized mean of the vectors", () => {
    const mean = average([
      [1, 0],
      [0, 1],
    ]);
    expect(mean[0]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(mean[1]).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it("weighs a direction by how many vectors point that way", () => {
    const [x, y] = average([
      [1, 0],
      [1, 0],
      [0, 1],
    ]);
    // Mean (2/3, 1/3), normalized.
    expect(x).toBeCloseTo(2 / Math.sqrt(5), 12);
    expect(y).toBeCloseTo(1 / Math.sqrt(5), 12);
  });

  it("of one vector is that vector, normalized", () => {
    expect(average([[0, 2]])).toEqual([0, 1]);
  });

  it("always has unit length", () => {
    const mean = average([
      [0.2, 0.9, 0.1],
      [0.5, 0.5, 0.7],
      [0.9, 0.1, 0.3],
    ]);
    expect(length(mean)).toBeCloseTo(1, 12);
  });

  it("rejects no vectors, vectors of different lengths and opposites that cancel out", () => {
    expect(() => average([])).toThrow();
    expect(() => average([[1, 0], [1]])).toThrow();
    expect(() =>
      average([
        [1, 0],
        [-1, 0],
      ]),
    ).toThrow();
  });
});

describe("pgvector text form", () => {
  it("round-trips", () => {
    const vector = [0.25, -0.5, 1e-7, 0];
    expect(toVectorLiteral(vector)).toBe("[0.25,-0.5,1e-7,0]");
    expect(parseVector(toVectorLiteral(vector))).toEqual(vector);
  });

  it("rejects text that isn't a list of numbers", () => {
    expect(() => parseVector('{"a":1}')).toThrow();
    expect(() => parseVector('["a"]')).toThrow();
  });
});
