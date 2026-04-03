export const getEnv = (key: string) => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    return window.__ENV__?.[key];
  }
  return process.env[key];
};
