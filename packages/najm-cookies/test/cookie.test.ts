import "reflect-metadata";
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Server } from "najm-core";
import { Controller, reset, Service, Inject } from "najm-core";
import { cookies } from "../src";
import { Get, Post, Params, Body } from "najm-core";
// ==========================================
// HELPER FUNCTIONS
// ==========================================

function collectCookies(response: Response): string {
  const cookies: string[] = [];

  try {
    const raw = (response.headers as any).raw?.();
    if (raw && raw['set-cookie']) {
      return raw['set-cookie'].join('; ');
    }
  } catch (e) { }

  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') {
      cookies.push(value.split(';')[0]);
    }
  }

  return cookies.join('; ') || response.headers.get('set-cookie') || '';
}

// ==========================================
// CONTROLLERS & SERVICES
// ==========================================

@Controller('/cookies')
class BasicCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set')
  setCookie() {
    this.cookie.set('test-cookie', 'test-value');
    return { message: 'Cookie set' };
  }

  @Get('/get')
  getCookie() {
    const value = this.cookie.get('test-cookie');
    return { value };
  }

  @Get('/delete')
  deleteCookie() {
    this.cookie.delete('test-cookie');
    return { message: 'Cookie deleted' };
  }

  @Get('/check')
  checkCookie() {
    const value = this.cookie.get('test-cookie');
    return { exists: value !== undefined, value };
  }
}

@Controller('/cookies')
class PrefixCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set')
  setCookie() {
    this.cookie.set('session', 'abc123');
    return { message: 'Cookie set' };
  }
}

@Controller('/cookies')
class OptionsCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set-default')
  setDefault() {
    this.cookie.set('secure-cookie', 'value');
    return { message: 'Cookie set' };
  }

  @Get('/set-override')
  setOverride() {
    this.cookie.set('test', 'value', { sameSite: 'None' });
    return { message: 'Cookie set' };
  }
}

@Controller('/cookies')
class ConvenienceCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set-secure')
  setSecure() {
    this.cookie.setSecure('auth-token', 'secret123');
    return { message: 'Secure cookie set' };
  }

  @Get('/set-session')
  setSession() {
    this.cookie.setSession('session-id', 'sess123');
    return { message: 'Session cookie set' };
  }

  @Get('/set-persistent')
  setPersistent() {
    this.cookie.setPersistent('remember-me', 'true', 7);
    return { message: 'Persistent cookie set' };
  }
}

@Controller('/cookies')
class MultipleCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set-multiple')
  setMultiple() {
    this.cookie.set('cookie1', 'value1');
    this.cookie.set('cookie2', 'value2');
    this.cookie.set('cookie3', 'value3');
    return { message: 'Cookies set' };
  }

  @Get('/get-all')
  getAll() {
    const cookies = this.cookie.getAll();
    return { cookies };
  }

  @Get('/check/:name')
  checkCookie(@Params('name') name: string) {
    const exists = this.cookie.has(name);
    return { name, exists };
  }
}

@Controller('/cookies')
class SignedCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set-signed')
  setSigned() {
    this.cookie.setSigned('user-id', '12345', 'my-secret-key-12345');
    return { message: 'Signed cookie set' };
  }

  @Get('/get-signed')
  getSigned() {
    const value = this.cookie.getSigned('user-id', 'my-secret-key-12345');
    return { value, valid: value !== undefined };
  }
}

@Controller('/cookies')
class SignedValidationController {
  private readonly SECRET = 'correct-secret';
  private readonly WRONG_SECRET = 'wrong-secret';

  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set-signed')
  setSigned() {
    this.cookie.setSigned('token', 'sensitive-data', this.SECRET);
    return { message: 'Signed cookie set' };
  }

  @Get('/verify-wrong')
  verifyWrong() {
    const value = this.cookie.getSigned('token', this.WRONG_SECRET);
    return { value, valid: value !== undefined };
  }

  @Get('/verify-correct')
  verifyCorrect() {
    const value = this.cookie.getSigned('token', this.SECRET);
    return { value, valid: value !== undefined };
  }
}

@Controller('/cookies')
class JSONCookieController {
  constructor(@Inject('Cookies') private cookie: any) { }

  @Get('/set-json')
  setJSON() {
    const userData = {
      id: 123,
      name: 'John Doe',
      roles: ['user', 'admin'],
      preferences: { theme: 'dark', lang: 'en' }
    };
    this.cookie.setJSON('user-data', userData);
    return { message: 'JSON cookie set' };
  }

  @Get('/get-json')
  getJSON() {
    const data = this.cookie.getJSON('user-data');
    return { data };
  }
}

@Service()
class SessionService {
  constructor(@Inject('Cookies') private cookie: any) { }

  createSession(userId: string) {
    const sessionId = `session_${userId}_${Date.now()}`;
    this.cookie.set('session-id', sessionId, {
      httpOnly: true,
      maxAge: 3600
    });
    return sessionId;
  }

  getSession() {
    return this.cookie.get('session-id');
  }

  destroySession() {
    this.cookie.delete('session-id');
  }
}

@Controller('/auth')
class AuthController {
  constructor(private sessionService: SessionService) { }

  @Post('/login')
  login(@Body() body: { userId: string }) {
    const sessionId = this.sessionService.createSession(body.userId);
    return { sessionId, message: 'Logged in' };
  }

  @Get('/session')
  getSession() {
    const sessionId = this.sessionService.getSession();
    return { sessionId, authenticated: !!sessionId };
  }

  @Post('/logout')
  logout() {
    this.sessionService.destroySession();
    return { message: 'Logged out' };
  }
}

@Service()
class CartService {
  constructor(@Inject('Cookies') private cookie: any) { }

  getCart() {
    const cart = this.cookie.getJSON('cart');
    return cart || [];
  }

  addItem(productId: string, quantity: number) {
    const cart = this.getCart();
    const existing = cart.find((item: any) => item.productId === productId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ productId, quantity });
    }

    this.cookie.setJSON('cart', cart, {
      maxAge: 30 * 24 * 60 * 60
    });
  }

  getItemCount() {
    const cart = this.getCart();
    return cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
  }
}

@Controller('/cart')
class CartController {
  constructor(private cartService: CartService) { }

  @Get('/')
  getCart() {
    const items = this.cartService.getCart();
    const total = this.cartService.getItemCount();
    return { items, total };
  }

  @Post('/add')
  addItem(@Body() body: { productId: string; quantity: number }) {
    this.cartService.addItem(body.productId, body.quantity);
    return { message: 'Item added' };
  }
}

// ==========================================
// TEST SUITE
// ==========================================

describe("Cookie Integration Tests (Simplified API)", () => {
  let server: Server;
  let baseURL: string;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  beforeEach(async () => {
    await reset();
  });

  // ==========================================
  // BASIC COOKIE OPERATIONS
  // ==========================================

  test("sets, retrieves, and deletes cookies", async () => {
    server = await new Server()
      .use(cookies({
        httpOnly: true,
        secure: false,
      }))
      .load(BasicCookieController)
      .listen(4002);

    baseURL = 'http://localhost:4002';

    // Set cookie
    const setResponse = await fetch(`${baseURL}/cookies/set`);
    const setCookies = setResponse.headers.get('set-cookie');

    expect(setCookies).toBeTruthy();
    expect(setCookies).toContain('test-cookie=test-value');

    // Get cookie
    const getResponse = await fetch(`${baseURL}/cookies/get`, {
      headers: { 'Cookie': setCookies! }
    });
    const data = await getResponse.json();
    expect(data.value).toBe('test-value');

    // Delete cookie
    const deleteResponse = await fetch(`${baseURL}/cookies/delete`, {
      headers: { 'Cookie': setCookies! }
    });
    const deleteCookie = deleteResponse.headers.get('set-cookie');

    expect(deleteCookie).toContain('test-cookie=');
    expect(deleteCookie).toContain('Max-Age=0');
  });

  // ==========================================
  // COOKIE OPTIONS TESTS
  // ==========================================

  test("applies prefix to cookie names", async () => {
    server = await new Server()
      .use(cookies({ prefix: 'myapp_' }))
      .load(PrefixCookieController)
      .listen(4004);

    baseURL = 'http://localhost:4004';

    const response = await fetch(`${baseURL}/cookies/set`);
    const setCookies = response.headers.get('set-cookie');

    expect(setCookies).toContain('myapp_session=abc123');
  });

  test("applies default httpOnly, secure, and sameSite options", async () => {
    server = await new Server()
      .use(cookies({
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      }))
      .load(OptionsCookieController)
      .listen(4006);

    baseURL = 'http://localhost:4006';

    const response = await fetch(`${baseURL}/cookies/set-default`);
    const setCookies = response.headers.get('set-cookie');

    expect(setCookies).toContain('HttpOnly');
    expect(setCookies).toContain('Secure');
    expect(setCookies).toContain('SameSite=Strict');
  });

  test("overrides default options with method options", async () => {
    server = await new Server()
      .use(cookies({ sameSite: 'Strict' }))
      .load(OptionsCookieController)
      .listen(4009);

    baseURL = 'http://localhost:4009';

    const response = await fetch(`${baseURL}/cookies/set-override`);
    const setCookies = response.headers.get('set-cookie');

    expect(setCookies).toContain('SameSite=None');
  });

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================

  test("convenience methods: setSecure, setSession, setPersistent", async () => {
    server = await new Server()
      .use(cookies({ maxAge: 3600 }))
      .load(ConvenienceCookieController)
      .listen(4010);

    baseURL = 'http://localhost:4010';

    // setSecure
    const secureResponse = await fetch(`${baseURL}/cookies/set-secure`);
    const secureCookies = secureResponse.headers.get('set-cookie');
    expect(secureCookies).toContain('HttpOnly');
    expect(secureCookies).toContain('Secure');
    expect(secureCookies).toContain('SameSite=Strict');

    // setSession (no maxAge)
    const sessionResponse = await fetch(`${baseURL}/cookies/set-session`);
    const sessionCookies = sessionResponse.headers.get('set-cookie');
    expect(sessionCookies).toContain('session-id=sess123');
    expect(sessionCookies).not.toContain('Max-Age');

    // setPersistent (with maxAge)
    const persistentResponse = await fetch(`${baseURL}/cookies/set-persistent`);
    const persistentCookies = persistentResponse.headers.get('set-cookie');
    const expectedMaxAge = 7 * 24 * 60 * 60;
    expect(persistentCookies).toContain('remember-me=true');
    expect(persistentCookies).toContain(`Max-Age=${expectedMaxAge}`);
  });

  // ==========================================
  // GETALL AND HAS TESTS
  // ==========================================

  test("getAll retrieves all cookies and has checks existence", async () => {
    server = await new Server()
      .use(cookies({}))
      .load(MultipleCookieController)
      .listen(4013);

    baseURL = 'http://localhost:4013';

    // Set multiple cookies
    const setResponse = await fetch(`${baseURL}/cookies/set-multiple`);
    const allCookies = collectCookies(setResponse);

    // Get all cookies
    const getAllResponse = await fetch(`${baseURL}/cookies/get-all`, {
      headers: { 'Cookie': allCookies }
    });
    const data = await getAllResponse.json();

    expect(data.cookies.cookie1).toBe('value1');
    expect(data.cookies.cookie2).toBe('value2');
    expect(data.cookies.cookie3).toBe('value3');

    // Check cookie existence
    const checkExists = await fetch(`${baseURL}/cookies/check/cookie1`, {
      headers: { 'Cookie': allCookies }
    });
    const existsData = await checkExists.json();
    expect(existsData.exists).toBe(true);

    const checkNotExists = await fetch(`${baseURL}/cookies/check/notexists`, {
      headers: { 'Cookie': allCookies }
    });
    const notExistsData = await checkNotExists.json();
    expect(notExistsData.exists).toBe(false);
  });

  // ==========================================
  // SIGNED COOKIES TESTS
  // ==========================================

  test("sets and retrieves signed cookies", async () => {
    server = await new Server()
      .use(cookies({}))
      .load(SignedCookieController)
      .listen(4015);

    baseURL = 'http://localhost:4015';

    const setResponse = await fetch(`${baseURL}/cookies/set-signed`);
    const cookieHeader = setResponse.headers.get('set-cookie')!;

    expect(cookieHeader).toContain('user-id=');
    expect(cookieHeader).toContain('.');

    const getResponse = await fetch(`${baseURL}/cookies/get-signed`, {
      headers: { 'Cookie': cookieHeader }
    });
    const data = await getResponse.json();

    expect(data.valid).toBe(true);
    expect(data.value).toBe('12345');
  });

  test("rejects signed cookies with invalid signature", async () => {
    server = await new Server()
      .use(cookies({}))
      .load(SignedValidationController)
      .listen(4016);

    baseURL = 'http://localhost:4016';

    const setResponse = await fetch(`${baseURL}/cookies/set-signed`);
    const cookieHeader = setResponse.headers.get('set-cookie')!;

    const wrongResponse = await fetch(`${baseURL}/cookies/verify-wrong`, {
      headers: { 'Cookie': cookieHeader }
    });
    const wrongData = await wrongResponse.json();
    expect(wrongData.valid).toBe(false);

    const correctResponse = await fetch(`${baseURL}/cookies/verify-correct`, {
      headers: { 'Cookie': cookieHeader }
    });
    const correctData = await correctResponse.json();
    expect(correctData.valid).toBe(true);
    expect(correctData.value).toBe('sensitive-data');
  });

  // ==========================================
  // JSON COOKIES TESTS
  // ==========================================

  test("sets and retrieves JSON cookies", async () => {
    server = await new Server()
      .use(cookies({}))
      .load(JSONCookieController)
      .listen(4017);

    baseURL = 'http://localhost:4017';

    const setResponse = await fetch(`${baseURL}/cookies/set-json`);
    const cookieHeader = setResponse.headers.get('set-cookie')!;

    const getResponse = await fetch(`${baseURL}/cookies/get-json`, {
      headers: { 'Cookie': cookieHeader }
    });
    const result = await getResponse.json();

    expect(result.data).toEqual({
      id: 123,
      name: 'John Doe',
      roles: ['user', 'admin'],
      preferences: { theme: 'dark', lang: 'en' }
    });
  });

  // ==========================================
  // REAL-WORLD: SESSION MANAGEMENT
  // ==========================================

  test("complete session management with dependency injection", async () => {
    server = await new Server()
      .use(cookies({}))
      .load(AuthController)
      .load(SessionService)
      .listen(4022);

    baseURL = 'http://localhost:4022';

    // Login
    const loginResponse = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user123' })
    });
    const loginData = await loginResponse.json();
    const sessionCookie = loginResponse.headers.get('set-cookie')!;

    expect(loginData.message).toBe('Logged in');
    expect(sessionCookie).toContain('session-id=');
    expect(sessionCookie).toContain('HttpOnly');

    // Get session
    const sessionResponse = await fetch(`${baseURL}/auth/session`, {
      headers: { 'Cookie': sessionCookie }
    });
    const sessionData = await sessionResponse.json();
    expect(sessionData.authenticated).toBe(true);

    // Logout
    const logoutResponse = await fetch(`${baseURL}/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
    const logoutData = await logoutResponse.json();
    expect(logoutData.message).toBe('Logged out');
  });

  // ==========================================
  // REAL-WORLD: SHOPPING CART
  // ==========================================

  test("shopping cart with JSON cookies", async () => {
    server = await new Server()
      .use(cookies({}))
      .load(CartController)
      .load(CartService)
      .listen(4023);

    baseURL = 'http://localhost:4023';

    // Add first item
    const add1 = await fetch(`${baseURL}/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'prod-1', quantity: 2 })
    });
    let cookieData = collectCookies(add1);

    // Add second item with previous cookies
    const add2 = await fetch(`${baseURL}/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieData
      },
      body: JSON.stringify({ productId: 'prod-2', quantity: 1 })
    });
    cookieData = collectCookies(add2);

    // Get cart with all cookies
    const cartResponse = await fetch(`${baseURL}/cart`, {
      headers: { 'Cookie': cookieData }
    });
    const cartData = await cartResponse.json();

    expect(cartData.items).toHaveLength(2);
    expect(cartData.total).toBe(3);
    expect(cartData.items[0]).toEqual({ productId: 'prod-1', quantity: 2 });
    expect(cartData.items[1]).toEqual({ productId: 'prod-2', quantity: 1 });
  });
});