export default {
  common: {
    success: 'Operation successful',
    error: 'An error occurred',
    notFound: 'Resource not found',
    unauthorized: 'Unauthorized access',
    forbidden: 'Access forbidden',
    // These field names are the kit's, one-for-one with NTablePaginationLabels.
    // buildPaginationLabels calls t() for every one of them, and najm-i18n
    // returns the key itself on a miss — so a field named anything else renders
    // as a literal key string in the UI, with nothing to flag it.
    pagination: {
      rowsPerPage: 'Rows/page',
      pagination: 'Pagination',
      goToPage: 'Go to page {{page}}',
      currentPage: 'Page {{page}}, current page',
      firstPage: 'First page',
      previousPage: 'Previous page',
      nextPage: 'Next page',
      lastPage: 'Last page',
      pageOf: 'Page {{page}} of {{pageCount}}',
      pageOfUnknown: 'Page {{page}}',
      rowsSelected: '{{selected}} of {{total}} row(s) selected.',
      // Card continuation, read by buildCardPaginationLabels off the same prefix.
      loadMoreError: 'Could not load more rows.',
      retryLoadMore: 'Retry',
      itemsLoaded: '{{count}} rows loaded',
    },
    // Same contract as `pagination` above, read by buildToolbarLabels off the
    // `common.table` prefix — the settings menu, the view modes, and the
    // filter chrome are built inside the kit, so this is the only way a
    // catalog reaches them.
    table: {
      settings: 'Table settings',
      view: 'View',
      columns: 'Columns',
      modeTable: 'Table',
      modeCards: 'Cards',
      modeJson: 'JSON',
      modeFiles: 'Files',
      modeOption: '{{mode}} view',
      filters: 'Filters',
      filterRegion: 'Table filters',
      allOption: 'All',
      create: 'Create',
    },
    // The kit's feedback prefix. Nine field names, one-for-one with
    // `ResolvedFeedbackLabels`, read by every N*State beneath the provider —
    // which is why this app passes no `feedbackDefaults` mapping at all.
    feedback: {
      loadingLabel: 'Loading…',
      emptyTitle: 'Nothing here yet',
      errorTitle: 'Something went wrong',
      errorMessage: 'Please try again in a moment.',
      retryLabel: 'Try again',
      forbiddenTitle: 'Access denied',
      forbiddenDescription: 'You do not have permission to view this page.',
      notFoundTitle: 'Page not found',
      notFoundDescription: 'The requested page could not be found.',
    },
    // Deliberately absent from `fr.ts`. With `fallbackToDefaultLanguage` on,
    // French renders this English text; with it off, French renders the key.
    // The i18n page shows both halves.
    untranslated: 'Base catalog only, {{count}} pending',
  },
  auth: {
    errors: {
      invalidCredentials: 'Invalid email or password',
      emailExists: 'Email already exists',
      accessDenied: 'Access denied',
      tokenExpired: 'Token has expired',
      tokenInvalid: 'Invalid token',
      tokenMissing: 'Authorization token is missing',
      tokenVerificationFailed: 'Token verification failed',
      tokenRevoked: 'Token has been revoked',
      refreshTokenMissing: 'Refresh token is missing',
      refreshTokenInvalid: 'Invalid refresh token',
      invalidResetToken: 'Invalid password reset token',
      resetTokenExpired: 'Password reset token has expired',
      unauthorized: 'Unauthorized access',
      sessionExpired: 'Session has expired',
    },
    success: {
      login: 'Login successful',
      logout: 'Logout successful',
      passwordChanged: 'Password changed successfully',
      tokenRefreshed: 'Token refreshed successfully',
    },
    confirm: {
      register: 'Register this account?',
      logout: 'Log out?',
    },
  },
  users: {
    errors: {
      notFound: 'User not found',
      idExists: 'User ID already exists',
      emailRequired: 'Email is required',
      passwordRequired: 'Password is required',
      invalidEmail: 'Invalid email format',
      weakPassword: 'Password is too weak',
      adminRoleNotFound: 'Admin role not found in system',
    },
    success: {
      created: 'User created successfully',
      updated: 'User updated successfully',
      deleted: 'User deleted successfully',
      retrieved: 'User retrieved successfully',
    },
    confirm: {
      create: 'Create this user?',
      update: 'Update this user?',
      delete: 'Delete this user?',
      assignRole: 'Assign this role to the user?',
      removeRole: 'Remove this user role?',
    },
  },
  roles: {
    errors: {
      notFound: 'Role not found',
      exists: 'Role already exists',
      nameRequired: 'Role name is required',
      cannotDeleteSystem: 'Cannot delete system role',
    },
    success: {
      created: 'Role created successfully',
      updated: 'Role updated successfully',
      deleted: 'Role deleted successfully',
      assigned: 'Role assigned successfully',
      retrieved: 'Role retrieved successfully',
    },
    confirm: {
      create: 'Create this role?',
      update: 'Update this role?',
      delete: 'Delete this role?',
    },
  },
  permissions: {
    errors: {
      notFound: 'Permission not found',
      nameExists: 'Permission name already exists',
      roleAlreadyHasPermission: 'Role already has this permission',
      cannotRemoveRequired: 'Cannot remove required permission',
    },
    success: {
      created: 'Permission created successfully',
      updated: 'Permission updated successfully',
      deleted: 'Permission deleted successfully',
      granted: 'Permission granted successfully',
      revoked: 'Permission revoked successfully',
      retrieved: 'Permissions retrieved successfully',
      assigned: 'Permission assigned to role successfully',
      removed: 'Permission removed from role successfully',
      allDeleted: 'All permissions deleted successfully',
    },
    confirm: {
      create: 'Create this permission?',
      update: 'Update this permission?',
      delete: 'Delete this permission?',
      assignToRole: 'Assign this permission to the role?',
      removeFromRole: 'Remove this permission from the role?',
    },
  },
  products: {
    created: 'Product "{{name}}" created successfully',
    createdSuccess: 'Product created successfully',
    retrieved: 'Products retrieved successfully',
    updated: 'Product updated successfully',
    deleted: 'Product deleted successfully',
    notFound: 'Product not found',
    accessDenied: 'Access denied to this product',
    list: {
      title: 'Product List',
      empty: 'No products available',
    },
    confirm: {
      create: 'Create this product?',
      update: 'Update this product?',
      delete: 'Delete this product?',
    },
  },
  cart: {
    retrieved: 'Cart retrieved successfully',
    cleared: 'Cart cleared successfully',
    itemAdded: 'Item added to cart',
    itemUpdated: 'Cart item updated',
    itemRemoved: 'Item removed from cart',
    itemNotFound: 'Cart item not found',
    productNotFound: 'Product not found',
    productUnavailable: 'Product is unavailable',
    confirm: {
      addItem: 'Add this item to your cart?',
      updateItem: 'Update this cart item?',
      removeItem: 'Remove this item from your cart?',
      clear: 'Clear your cart?',
    },
  },
  orders: {
    created: 'Order created successfully',
    retrieved: 'Orders retrieved successfully',
    checkoutCompleted: 'Checkout completed successfully',
    statusUpdated: 'Order status updated successfully',
    notFound: 'Order not found',
    accessDenied: 'Access denied to this order',
    statusLocked: 'Delivered or cancelled orders cannot be changed',
    cartEmpty: 'Cart is empty',
    productNotFound: 'Product not found',
    productUnavailable: 'Product is unavailable',
    confirm: {
      create: 'Create this order?',
      checkout: 'Checkout your cart and create an order?',
      updateStatus: 'Update this order status?',
    },
  },
  validation: {
    required: '{{field}} is required',
    invalidEmail: 'Invalid email format',
    minLength: '{{field}} must be at least {{min}} characters',
    maxLength: '{{field}} must be at most {{max}} characters',
  },
};
