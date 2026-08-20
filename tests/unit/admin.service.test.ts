import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as adminService from "../../src/modules/admin/admin.service.js";
import { adminRepository } from "../../src/modules/admin/admin.repository.js";
import { db } from "../../src/config/prisma.js";

const originalPrisma = db.prisma;

test("Admin Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        // Mock Prisma Transaction
        db.prisma = {
            $transaction: async (callback: any) => {
                return callback({});
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
    });

    await t.test("listUsers - should return user list with metadata successfully", async () => {
        const mockUsers = [
            {
                id: "user-uuid-1",
                email: "user1@example.com",
                display_name: "User One",
                avatar: null,
                level: 1,
                exp: 100,
                streak: 2,
                role: "user",
                status: "active",
                created_at: new Date("2026-08-04T03:15:22.000Z"),
            }
        ];

        mock.method(adminRepository, "findFilteredUsers", async () => mockUsers);
        mock.method(adminRepository, "countFilteredUsers", async () => 1);

        const result = await adminService.listUsers({
            page: 1,
            limit: 50,
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].id, "user-uuid-1");
        assert.strictEqual(result.meta.total, 1);
        assert.strictEqual(result.meta.total_pages, 1);
    });

    await t.test("getUserDetail - should return user detail with review and pvp stats", async () => {
        const mockUser = {
            id: "user-uuid-1",
            email: "user1@example.com",
            display_name: "User One",
            avatar: null,
            level: 1,
            exp: 100,
            streak: 2,
            role: "user",
            status: "active",
            created_at: new Date("2026-08-04T03:15:22.000Z"),
        };

        const mockPvpStats = {
            total_matches: 42,
            total_score: 1350,
        };

        mock.method(adminRepository, "findUserById", async () => mockUser);
        mock.method(adminRepository, "countUserReviews", async () => 320);
        mock.method(adminRepository, "findUserPvpStatistics", async () => mockPvpStats);

        const result = await adminService.getUserDetail("user-uuid-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "user-uuid-1");
        assert.strictEqual(result.data.total_reviews, 320);
        assert.strictEqual(result.data.pvp_matches, 42);
        assert.strictEqual(result.data.pvp_rating, 1350);
    });

    await t.test("getUserDetail - should throw USER_NOT_FOUND if user does not exist", async () => {
        mock.method(adminRepository, "findUserById", async () => null);

        await assert.rejects(
            adminService.getUserDetail("non-existent-uuid"),
            /USER_NOT_FOUND/
        );
    });

    await t.test("updateUserStatus - should update status and create audit log", async () => {
        const mockUser = {
            id: "user-uuid-1",
            status: "active",
        };

        mock.method(adminRepository, "findUserById", async () => mockUser);
        const updateStatusMock = mock.method(adminRepository, "updateUserStatus", async () => ({}));
        const revokeSessionsMock = mock.method(adminRepository, "revokeAllSessions", async () => ({}));
        const createAuditLogMock = mock.method(adminRepository, "createAuditLog", async () => ({}));

        const result = await adminService.updateUserStatus({
            adminId: "admin-uuid",
            userId: "user-uuid-1",
            status: "suspended",
            reason: "Violation",
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.status, "suspended");
        assert.strictEqual(updateStatusMock.mock.callCount(), 1);
        assert.strictEqual(revokeSessionsMock.mock.callCount(), 1); // should revoke sessions for suspended
        assert.strictEqual(createAuditLogMock.mock.callCount(), 1);
    });

    await t.test("updateUserStatus - should throw CANNOT_MODIFY_SELF", async () => {
        await assert.rejects(
            adminService.updateUserStatus({
                adminId: "admin-uuid",
                userId: "admin-uuid",
                status: "suspended",
            }),
            /CANNOT_MODIFY_SELF/
        );
    });

    await t.test("updateUserRole - should update role and create audit log", async () => {
        const mockUser = {
            id: "user-uuid-1",
            role: "user",
        };

        mock.method(adminRepository, "findUserById", async () => mockUser);
        const updateRoleMock = mock.method(adminRepository, "updateUserRole", async () => ({}));
        const createAuditLogMock = mock.method(adminRepository, "createAuditLog", async () => ({}));

        const result = await adminService.updateUserRole({
            adminId: "admin-uuid",
            userId: "user-uuid-1",
            role: "admin",
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.role, "admin");
        assert.strictEqual(updateRoleMock.mock.callCount(), 1);
        assert.strictEqual(createAuditLogMock.mock.callCount(), 1);
    });

    await t.test("updateUserRole - should throw CANNOT_MODIFY_SELF", async () => {
        await assert.rejects(
            adminService.updateUserRole({
                adminId: "admin-uuid",
                userId: "admin-uuid",
                role: "admin",
            }),
            /CANNOT_MODIFY_SELF/
        );
    });

    await t.test("listAuditLogs - should return audit logs", async () => {
        const mockLogs = [
            {
                id: "log-uuid-1",
                admin_id: "admin-uuid",
                action: "user.status_changed",
                entity_id: "user-uuid-1",
                before_state: { status: "active" },
                after_state: { status: "suspended", reason: "Spam" },
                created_at: new Date("2026-08-04T11:00:00.000Z"),
                users: {
                    display_name: "Super Admin",
                },
            }
        ];

        mock.method(adminRepository, "findAuditLogs", async () => mockLogs);
        mock.method(adminRepository, "countAuditLogs", async () => 1);

        const result = await adminService.listAuditLogs({
            page: 1,
            limit: 50,
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].admin_name, "Super Admin");
        assert.strictEqual(result.meta.total, 1);
    });
});
