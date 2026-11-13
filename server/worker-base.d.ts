declare module "#music-worker-base" {
  const worker: {
    fetch(request: Request, env: unknown, context: unknown): Promise<Response>;
  };
  export default worker;
}
