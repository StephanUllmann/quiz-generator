class HttpError extends Error {
	constructor(
		public message: string,
		public cause: { status: number },
	) {
		super(message);
		this.cause = cause;
	}
}

export { HttpError };
