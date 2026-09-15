import { describe, expect, it } from "vitest";
import { domainsOwnedBy, initialOwnersYaml, parseOwners, resolveApprovers } from "~/lib/brain/owners";
import { owners } from "./fixtures";

describe("owners", () => {
  it("resolves domain owners plus path owners", () => {
    expect(resolveApprovers(owners, { domain: "marketing", path: "rules/marketing/x.md" }).sort()).toEqual(["bamboo", "growth-lead"]);
    expect(resolveApprovers(owners, { domain: "marketing", path: "refs/marketing/x.md" }).sort()).toEqual(["bamboo", "eng-lead", "growth-lead"]);
    expect(resolveApprovers(owners, { path: "OWNERS.yaml" }).sort()).toEqual(["eng-lead", "growth-lead"]);
    expect(resolveApprovers(owners, { domain: "nope", path: "rules/nope/x.md" })).toEqual([]);
  });
  it("lists domains a handle owns", () => {
    expect(domainsOwnedBy(owners, "eng-lead").sort()).toEqual(["compliance", "engineering", "ops"]);
    expect(domainsOwnedBy(owners, "nobody")).toEqual([]);
  });
  it("rejects invalid files", () => {
    expect(() => parseOwners("domains:\n  Marketing: { owners: [x] }\n")).toThrow(/invalid/);
  });
  it("generates a valid initial file", () => {
    const text = initialOwnersYaml({ handle: "cam", name: "Cam", email: "cam@example.com" }, ["marketing", "ops"]);
    const o = parseOwners(text);
    expect(o.domains.marketing.owners).toEqual(["cam"]);
    expect(o.paths["OWNERS.yaml"].owners).toEqual(["cam"]);
    expect(o.identities.cam.channels).toEqual(["email:cam@example.com"]);
  });
});
