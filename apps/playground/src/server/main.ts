import 'reflect-metadata';
import { server } from './index';

await server.listen(process.env.PORT);
