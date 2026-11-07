import { describe, expect, it } from "vitest";
import { allowedAccountForEmail, accessWhitelist } from "@/config/access";
import { can, roleLabel } from "@/lib/permissions";

describe("authentification et permissions Phase 6A", () => {
  it("n’autorise que les trois comptes explicitement listés", () => {
    expect(accessWhitelist).toHaveLength(3);
    expect(allowedAccountForEmail("LAASSAS.YOUNESS65@GMAIL.COM")?.role).toBe(
      "owner",
    );
    expect(
      allowedAccountForEmail("yl.younesslaaassas@gmail.com")?.role,
    ).toBe("commercial");
    expect(allowedAccountForEmail("techniquegi39@gmail.com")?.role).toBe("dg");
    expect(allowedAccountForEmail("intrus@example.com")).toBeNull();
    expect(allowedAccountForEmail(null)).toBeNull();
  });

  it("applique les permissions du propriétaire et du directeur général", () => {
    expect(can("owner", "delete", "documents")).toBe(true);
    expect(can("owner", "manageUsers", "users")).toBe(true);
    expect(can("dg", "read", "collections")).toBe(true);
    expect(can("dg", "approve", "contracts")).toBe(true);
    expect(can("dg", "readPurchasePrice", "catalogue")).toBe(true);
    expect(can("dg", "delete", "documents")).toBe(false);
    expect(can("dg", "manageUsers", "users")).toBe(false);
  });

  it("limite le rôle commercial et refuse les rôles/actions inconnus", () => {
    expect(can("commercial", "create", "clients")).toBe(true);
    expect(can("commercial", "create", "documents")).toBe(true);
    expect(can("commercial", "read", "contracts")).toBe(true);
    expect(can("commercial", "read", "elevators")).toBe(true);
    expect(can("commercial", "readPurchasePrice", "catalogue")).toBe(false);
    expect(can("commercial", "readMargins", "catalogue")).toBe(false);
    expect(can("commercial", "delete", "documents")).toBe(false);
    expect(can("commercial", "manageUsers", "users")).toBe(false);
    expect(can(null, "read", "dashboard")).toBe(false);
    expect(roleLabel("dg")).toBe("Directeur Général");
  });
});
