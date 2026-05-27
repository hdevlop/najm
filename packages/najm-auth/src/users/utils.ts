export const isImage = (file: any): boolean => {
  // Handle File objects
  if (file && typeof file === 'object' && file.type) {
    return file.type.startsWith('image/');
  }
  
  // Handle file paths/names
  if (typeof file === 'string') {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'avif'];
    const extension = file.toLowerCase().split('.').pop();
    return imageExtensions.includes(extension || '');
  }
  
  return false;
};