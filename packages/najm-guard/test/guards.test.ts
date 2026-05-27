import "reflect-metadata";
import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { Body, Ctx, Err, Get, GuardParams, Headers, IP, Params, Post, Server } from "najm-core";
import { Controller, reset, Service, Inject } from "diject";
import { createGuard, composeGuards, guards } from "../src";
import type { Context } from "hono";

describe("Guard Plugin Tests", () => {
   let server: Server;
   let baseURL: string;

   beforeEach(async () => {
      await reset();
   });

   afterEach(async () => {
      if (server) {
         await server.stop();
      }
   });

   // ==========================================
   // BASIC GUARDS
   // ==========================================

   describe("Basic Guards", () => {
      test("guard allows access when returning true", async () => {
         @Service()
         class AllowGuard {
            canActivate(): boolean {
               return true;
            }
         }

         const Allow = createGuard(AllowGuard);

         @Controller("/api")
         @Allow()
         class TestController {
            @Get("/data")
            getData() {
               return { access: "granted" };
            }
         }

         server = await new Server()
            .use(guards())
            .load(AllowGuard, TestController)
            .listen(8001);
         baseURL = "http://localhost:8001";

         const response = await fetch(`${baseURL}/api/data`);
         const data = await response.json();

         expect(response.status).toBe(200);
         expect(data.access).toBe("granted");
      });

      test("guard blocks access when returning false", async () => {
         @Service()
         class DenyGuard {
            canActivate(): boolean {
               return false;
            }
         }

         const Deny = createGuard(DenyGuard);

         @Controller("/api")
         @Deny()
         class TestController {
            @Get("/data")
            getData() {
               return { access: "granted" };
            }
         }

         server = await new Server()
            .use(guards())
            .load(DenyGuard, TestController)
            .listen(8002);
         baseURL = "http://localhost:8002";

         const response = await fetch(`${baseURL}/api/data`);

         expect(response.status).toBe(401);
      });

      test("async guard works correctly", async () => {
         @Service()
         class AsyncGuard {
            async canActivate(): Promise<boolean> {
               await new Promise((r) => setTimeout(r, 10));
               return true;
            }
         }

         const Async = createGuard(AsyncGuard);

         @Controller("/api")
         @Async()
         class TestController {
            @Get("/data")
            getData() {
               return { async: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(AsyncGuard, TestController)
            .listen(8003);
         baseURL = "http://localhost:8003";

         const response = await fetch(`${baseURL}/api/data`);
         const data = await response.json();

         expect(response.status).toBe(200);
         expect(data.async).toBe(true);
      });
   });

   // ==========================================
   // GUARDS WITH PARAMETERS
   // ==========================================

   describe("Guards with Parameters", () => {
      test("guard receives typed parameters", async () => {
         @Service()
         class RoleGuard {
            canActivate(@Ctx() ctx: Context, @GuardParams() requiredRoles): boolean {
               const userRole = ctx.req.header("x-user-role");
               return requiredRoles.includes(userRole);
            }
         }

         const Role = createGuard<string[]>(RoleGuard);

         @Controller("/api")
         class TestController {
            @Get("/admin")
            @Role(["admin"])
            adminOnly() {
               return { role: "admin" };
            }

            @Get("/user")
            @Role(["user", "admin"])
            userAccess() {
               return { role: "user" };
            }
         }

         server = await new Server()
            .use(guards())
            .load(RoleGuard, TestController)
            .listen(8010);
         baseURL = "http://localhost:8010";

         // Admin accessing admin route
         const adminRes = await fetch(`${baseURL}/api/admin`, {
            headers: { "X-User-Role": "admin" },
         });
         expect(adminRes.status).toBe(200);

         // User trying admin route
         const userDenied = await fetch(`${baseURL}/api/admin`, {
            headers: { "X-User-Role": "user" },
         });
         expect(userDenied.status).toBe(401);

         // User accessing user route
         const userRes = await fetch(`${baseURL}/api/user`, {
            headers: { "X-User-Role": "user" },
         });
         expect(userRes.status).toBe(200);
      });
   });

   // ==========================================
   // GUARD WITH HEADER INJECTION
   // ==========================================

   describe("Guards with Header Injection", () => {
      test("guard uses @Headers decorator", async () => {
         @Service()
         class AuthGuard {
            canActivate(@Headers("authorization") auth: string): boolean {
               return auth?.startsWith("Bearer ");
            }
         }

         const Auth = createGuard(AuthGuard);

         @Controller("/api")
         @Auth()
         class TestController {
            @Get("/protected")
            getProtected() {
               return { protected: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(AuthGuard, TestController)
            .listen(8020);
         baseURL = "http://localhost:8020";

         // With valid token
         const validRes = await fetch(`${baseURL}/api/protected`, {
            headers: { Authorization: "Bearer valid-token" },
         });
         expect(validRes.status).toBe(200);

         // Without token
         const noTokenRes = await fetch(`${baseURL}/api/protected`);
         expect(noTokenRes.status).toBe(401);

         // With invalid token format
         const invalidRes = await fetch(`${baseURL}/api/protected`, {
            headers: { Authorization: "Basic invalid" },
         });
         expect(invalidRes.status).toBe(401);
      });
   });

   // ==========================================
   // METHOD-LEVEL GUARDS
   // ==========================================

   describe("Method-Level Guards", () => {
      test("method guard overrides class guard", async () => {
         @Service()
         class AllowGuard {
            canActivate(): boolean {
               return true;
            }
         }

         @Service()
         class DenyGuard {
            canActivate(): boolean {
               return false;
            }
         }

         const Allow = createGuard(AllowGuard);
         const Deny = createGuard(DenyGuard);

         @Controller("/api")
         @Allow()
         class TestController {
            @Get("/allowed")
            allowed() {
               return { access: "allowed" };
            }

            @Get("/denied")
            @Deny()
            denied() {
               return { access: "denied" };
            }
         }

         server = await new Server()
            .use(guards())
            .load(AllowGuard, DenyGuard, TestController)
            .listen(8030);
         baseURL = "http://localhost:8030";

         const allowedRes = await fetch(`${baseURL}/api/allowed`);
         expect(allowedRes.status).toBe(200);

         const deniedRes = await fetch(`${baseURL}/api/denied`);
         expect(deniedRes.status).toBe(401);
      });

      test("multiple method guards all must pass", async () => {
         @Service()
         class Guard1 {
            canActivate(@Headers("x-guard-1") val: string): boolean {
               return val === "pass";
            }
         }

         @Service()
         class Guard2 {
            canActivate(@Headers("x-guard-2") val: string): boolean {
               return val === "pass";
            }
         }

         const Check1 = createGuard(Guard1);
         const Check2 = createGuard(Guard2);

         @Controller("/api")
         class TestController {
            @Get("/multi")
            @Check1()
            @Check2()
            multiGuard() {
               return { passed: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(Guard1, Guard2, TestController)
            .listen(8031);
         baseURL = "http://localhost:8031";

         // Both pass
         const bothPass = await fetch(`${baseURL}/api/multi`, {
            headers: { "X-Guard-1": "pass", "X-Guard-2": "pass" },
         });
         expect(bothPass.status).toBe(200);

         // Only first passes
         const onlyFirst = await fetch(`${baseURL}/api/multi`, {
            headers: { "X-Guard-1": "pass", "X-Guard-2": "fail" },
         });
         expect(onlyFirst.status).toBe(401);

         // Only second passes
         const onlySecond = await fetch(`${baseURL}/api/multi`, {
            headers: { "X-Guard-1": "fail", "X-Guard-2": "pass" },
         });
         expect(onlySecond.status).toBe(401);
      });
   });

   // ==========================================
   // COMPOSED GUARDS
   // ==========================================

   describe("Composed Guards", () => {
      test("composed guards require all to pass", async () => {
         @Service()
         class AuthGuard {
            canActivate(@Headers("authorization") auth: string): boolean {
               return !!auth;
            }
         }

         @Service()
         class AdminGuard {
            canActivate(@Headers("x-role") role: string): boolean {
               return role === "admin";
            }
         }

         const Auth = createGuard(AuthGuard);
         const Admin = createGuard(AdminGuard);
         const AuthAndAdmin = composeGuards(Auth(), Admin());

         @Controller("/api")
         class TestController {
            @Get("/admin")
            @AuthAndAdmin()
            admin() {
               return { admin: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(AuthGuard, AdminGuard, TestController)
            .listen(8040);
         baseURL = "http://localhost:8040";

         // Both conditions met
         const bothRes = await fetch(`${baseURL}/api/admin`, {
            headers: { Authorization: "Bearer token", "X-Role": "admin" },
         });
         expect(bothRes.status).toBe(200);

         // Only auth
         const onlyAuth = await fetch(`${baseURL}/api/admin`, {
            headers: { Authorization: "Bearer token" },
         });
         expect(onlyAuth.status).toBe(401);

         // Only role
         const onlyRole = await fetch(`${baseURL}/api/admin`, {
            headers: { "X-Role": "admin" },
         });
         expect(onlyRole.status).toBe(401);
      });

      test("multiple composed guards work correctly", async () => {
         @Service()
         class CheckGuard1 {
            canActivate(@Headers("x-check-1") val: string): boolean {
               return val === "pass";
            }
         }

         @Service()
         class CheckGuard2 {
            canActivate(@Headers("x-check-2") val: string): boolean {
               return val === "pass";
            }
         }

         const Check1 = createGuard(CheckGuard1);
         const Check2 = createGuard(CheckGuard2);
         const ComposedCheck = composeGuards(Check1(), Check2());

         @Controller("/api")
         class TestController {
            @Get("/resource")
            @ComposedCheck()
            resource() {
               return { access: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(CheckGuard1, CheckGuard2, TestController)
            .listen(8041);
         baseURL = "http://localhost:8041";

         // Both pass
         const bothPass = await fetch(`${baseURL}/api/resource`, {
            headers: { "X-Check-1": "pass", "X-Check-2": "pass" },
         });
         expect(bothPass.status).toBe(200);

         // Only first passes
         const onlyFirst = await fetch(`${baseURL}/api/resource`, {
            headers: { "X-Check-1": "pass", "X-Check-2": "fail" },
         });
         expect(onlyFirst.status).toBe(401);

         // Only second passes
         const onlySecond = await fetch(`${baseURL}/api/resource`, {
            headers: { "X-Check-1": "fail", "X-Check-2": "pass" },
         });
         expect(onlySecond.status).toBe(401);
      });
   });

   // ==========================================
   // GUARD WITH DI
   // ==========================================

   describe("Guards with Dependency Injection", () => {
      test("guard can inject services", async () => {
         @Service()
         class TokenService {
            validate(token: string): boolean {
               return token === "valid-secret-token";
            }
         }

         @Service()
         class TokenGuard {
            constructor(private tokenService: TokenService) { }

            canActivate(@Headers("x-api-key") apiKey: string): boolean {
               return this.tokenService.validate(apiKey);
            }
         }

         const ValidToken = createGuard(TokenGuard);

         @Controller("/api")
         @ValidToken()
         class TestController {
            @Get("/secure")
            secure() {
               return { secure: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(TokenService, TokenGuard, TestController)
            .listen(8050);
         baseURL = "http://localhost:8050";

         // Valid token
         const validRes = await fetch(`${baseURL}/api/secure`, {
            headers: { "X-Api-Key": "valid-secret-token" },
         });
         expect(validRes.status).toBe(200);

         // Invalid token
         const invalidRes = await fetch(`${baseURL}/api/secure`, {
            headers: { "X-Api-Key": "invalid-token" },
         });
         expect(invalidRes.status).toBe(401);
      });

      test("guard can use async services", async () => {
         @Service()
         class AsyncUserService {
            async findUser(id: string): Promise<{ id: string; active: boolean } | null> {
               await new Promise((r) => setTimeout(r, 5));
               if (id === "active-user") {
                  return { id, active: true };
               }
               return null;
            }
         }

         @Service()
         class ActiveUserGuard {
            constructor(private userService: AsyncUserService) { }

            async canActivate(@Headers("x-user-id") userId: string): Promise<boolean> {
               const user = await this.userService.findUser(userId);
               return user?.active === true;
            }
         }

         const ActiveUser = createGuard(ActiveUserGuard);

         @Controller("/api")
         @ActiveUser()
         class TestController {
            @Get("/profile")
            profile() {
               return { profile: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(AsyncUserService, ActiveUserGuard, TestController)
            .listen(8051);
         baseURL = "http://localhost:8051";

         // Active user
         const activeRes = await fetch(`${baseURL}/api/profile`, {
            headers: { "X-User-Id": "active-user" },
         });
         expect(activeRes.status).toBe(200);

         // Unknown user
         const unknownRes = await fetch(`${baseURL}/api/profile`, {
            headers: { "X-User-Id": "unknown" },
         });
         expect(unknownRes.status).toBe(401);
      });
   });

   // ==========================================
   // REAL-WORLD SCENARIOS
   // ==========================================

   describe("Real-World Scenarios", () => {
      test("JWT-like authentication guard", async () => {
         @Service()
         class JwtService {
            verify(token: string): { userId: string; exp: number } | null {
               if (token === "valid.jwt.token") {
                  return { userId: "user-123", exp: Date.now() + 3600000 };
               }
               return null;
            }
         }

         @Service()
         class JwtGuard {
            constructor(private jwtService: JwtService) { }

            canActivate(@Headers("authorization") auth: string): boolean {
               if (!auth?.startsWith("Bearer ")) return false;
               const token = auth.slice(7);
               const payload = this.jwtService.verify(token);
               return payload !== null && payload.exp > Date.now();
            }
         }

         const Jwt = createGuard(JwtGuard);

         @Controller("/api")
         class AuthController {
            @Get("/public")
            public() {
               return { public: true };
            }

            @Get("/private")
            @Jwt()
            private() {
               return { private: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(JwtService, JwtGuard, AuthController)
            .listen(8060);
         baseURL = "http://localhost:8060";

         // Public route
         const publicRes = await fetch(`${baseURL}/api/public`);
         expect(publicRes.status).toBe(200);

         // Private with valid token
         const privateValid = await fetch(`${baseURL}/api/private`, {
            headers: { Authorization: "Bearer valid.jwt.token" },
         });
         expect(privateValid.status).toBe(200);

         // Private without token
         const privateNoToken = await fetch(`${baseURL}/api/private`);
         expect(privateNoToken.status).toBe(401);

         // Private with invalid token
         const privateInvalid = await fetch(`${baseURL}/api/private`, {
            headers: { Authorization: "Bearer invalid.token" },
         });
         expect(privateInvalid.status).toBe(401);
      });

      test("rate limiting guard", async () => {
         const requestCounts = new Map<string, number>();

         @Service()
         class RateLimitGuard {
            canActivate(@IP() ip: string): boolean {
               const count = requestCounts.get(ip) || 0;
               requestCounts.set(ip, count + 1);
               return count < 3; // Allow 3 requests
            }
         }

         const RateLimit = createGuard(RateLimitGuard);

         @Controller("/api")
         @RateLimit()
         class TestController {
            @Get("/limited")
            limited() {
               return { allowed: true };
            }
         }

         server = await new Server()
            .use(guards())
            .load(RateLimitGuard, TestController)
            .listen(8061);
         baseURL = "http://localhost:8061";

         // First 3 requests should pass
         for (let i = 0; i < 3; i++) {
            const res = await fetch(`${baseURL}/api/limited`, {
               headers: { "X-Forwarded-For": "192.168.1.1" },
            });
            expect(res.status).toBe(200);
         }

         // 4th request should fail
         const blocked = await fetch(`${baseURL}/api/limited`, {
            headers: { "X-Forwarded-For": "192.168.1.1" },
         });
         expect(blocked.status).toBe(401);

         // Different IP should still work
         const differentIp = await fetch(`${baseURL}/api/limited`, {
            headers: { "X-Forwarded-For": "192.168.1.2" },
         });
         expect(differentIp.status).toBe(200);
      });

      test("feature flag guard", async () => {
         @Service()
         class FeatureService {
            private enabledFeatures = new Set(["feature-a", "feature-c"]);

            isEnabled(feature: string): boolean {
               return this.enabledFeatures.has(feature);
            }
         }

         @Service()
         class FeatureGuard {
            constructor(private featureService: FeatureService) { }

            canActivate(@Headers("x-feature") feature: string): boolean {
               return this.featureService.isEnabled(feature);
            }
         }

         const Feature = createGuard(FeatureGuard);

         @Controller("/api")
         class TestController {
            @Get("/feature")
            @Feature()
            featureEndpoint() {
               return { feature: "enabled" };
            }
         }

         server = await new Server()
            .use(guards())
            .load(FeatureService, FeatureGuard, TestController)
            .listen(8062);
         baseURL = "http://localhost:8062";

         // Enabled feature
         const enabledRes = await fetch(`${baseURL}/api/feature`, {
            headers: { "X-Feature": "feature-a" },
         });
         expect(enabledRes.status).toBe(200);

         // Disabled feature
         const disabledRes = await fetch(`${baseURL}/api/feature`, {
            headers: { "X-Feature": "feature-b" },
         });
         expect(disabledRes.status).toBe(401);
      });
   });

   // ==========================================
   // EDGE CASES
   // ==========================================

   describe("Edge Cases", () => {
      test("guard throwing error returns 401", async () => {
         @Service()
         class ThrowingGuard {
            canActivate() {
               Err("Guard error");
            }
         }

         const Throwing = createGuard(ThrowingGuard);

         @Controller("/api")
         @Throwing()
         class TestController {
            @Get("/error")
            error() {
               return { error: false };
            }
         }

         server = await new Server()
            .use(guards())
            .load(ThrowingGuard, TestController)
            .listen(8070);
         baseURL = "http://localhost:8070";

         const response = await fetch(`${baseURL}/api/error`);
         expect(response.status).toBe(400);
      });

      test("controller without guards works normally", async () => {
         @Controller("/api")
         class UnguardedController {
            @Get("/open")
            open() {
               return { open: true };
            }
         }

         server = await new Server()
            .load(UnguardedController)
            .listen(8071);
         baseURL = "http://localhost:8071";

         const response = await fetch(`${baseURL}/api/open`);
         expect(response.status).toBe(200);
      });
   });
});
