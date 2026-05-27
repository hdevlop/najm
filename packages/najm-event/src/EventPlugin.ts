import { plugin } from 'najm-core';
import { EventService } from './EventService';

export const events = () =>
  plugin('events')
    .services(EventService)
    .build();
