import { Controller, Get, Service } from 'najm-api';
import { createGuard } from 'najm-guard';

class AllowGuard {
  canActivate() {
    return true;
  }
}

class DenyGuard {
  canActivate() {
    return false;
  }
}

Service()(AllowGuard);
Service()(DenyGuard);

const allow = createGuard(AllowGuard)();
const deny = createGuard(DenyGuard)();

export const AllowedInjectionController = class SharedInjectionController {
  check() {
    return { route: 'allowed', isolated: true };
  }
};

export const DeniedInjectionController = class SharedInjectionController {
  check() {
    return { route: 'denied', isolated: true };
  }
};

function decorateController(
  target: typeof AllowedInjectionController,
  path: string,
  guard: MethodDecorator,
) {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, 'check');
  if (!descriptor) throw new Error(`Missing check method for ${path}`);

  guard(target.prototype, 'check', descriptor);
  Get('/')(target.prototype, 'check', descriptor);
  Controller(path)(target);
}

decorateController(AllowedInjectionController, '/injection-regression/allowed', allow);
decorateController(DeniedInjectionController, '/injection-regression/denied', deny);

export { AllowGuard, DenyGuard };
