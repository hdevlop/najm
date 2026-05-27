# najm-events

Optional events (event bus) plugin for Najm framework with decorator-based event handling and async event emission.

## Installation

```bash
bun install najm-events
```

## Usage

```typescript
import { On, Events } from 'najm-events';

// Listen to events with the @On decorator
@Service()
class UserService {
  @On('user.created')
  async handleUserCreated(data: any) {
    console.log('User created:', data);
  }
}

// Inject event methods using @Events decorator
@Controller('/api/users')
class UserController {
  @Events() private events!: any;

  @Post('/create')
  async createUser(@Body() userData: any) {
    // Create user logic here
    const user = await this.userService.create(userData);
    
    // Emit event
    this.events.emit('user.created', user);
    
    return user;
  }
}
```

## Features

- Decorator-based event handling with `@On()` and `@Events()`
- Async event emission with error handling
- Integration with Najm's DI system
- Event statistics and management