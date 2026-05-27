import "reflect-metadata";
import { Server } from "./server";
import { cors } from "najm-cors";
import { Controller, Service } from "diject";
import { Get, Post } from "./router";
import { Body } from "./params";

@Controller('/api')
class TestController {
  @Get('/data')
  getData() {
    return { message: 'Hello World' };
  }

  @Post('/create')
  createData(@Body() body: any) {
    return { id: 1, ...body };
  }
}

@Controller('/api/v1')
class V1Controller {
  @Get('/users')
  getUsers() {
    return [{ id: 1, name: 'John' }];
  }
}

@Controller('/api/v2')
class V2Controller {
  @Get('/posts')
  getPosts() {
    return [{ id: 1, title: 'Post 1' }];
  }
}

@Service()
class DataService {
  getData() {
    return { value: 42, source: 'service' };
  }
}

@Controller('/api')
class ServiceController {
  constructor(private dataService: DataService) { }

  @Get('/service-data')
  getServiceData() {
    return this.dataService.getData();
  }
}



const server = await new Server()
  .base('/api')
  .use(cors())
  .load(TestController, ServiceController,V2Controller,V1Controller)
  .listen(3000);



