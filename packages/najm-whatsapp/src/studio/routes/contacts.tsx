import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { ContactsView } from '@/features/contacts';

export const contactsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contacts',
  component: ContactsView,
});
