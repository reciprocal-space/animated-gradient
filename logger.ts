// type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILoggerOptions {
    ctx?: unknown;
    level: Level;
    message: string;
    prefix?: string;
};

enum Level {
    Debug = 0,
    Info = 10,
    Warn = 20,
    Error = 30
};

type LoggerLevel = keyof typeof Level;

export abstract class Logger {
    readonly name: string;
    readonly level: Level;

    constructor(name: string, level = Level.Info) {
        this.name = name;
        this.level = level;
    }

    static serialize(event: Record<string, unknown>): string {
        return JSON.stringify(event);
    }

    log(level: Level, message: string, ctx?: unknown): void {
        this.emitFormatted({ ctx, level, message })
    }

    debug(message: string, ctx?: unknown): void {
        this.emitFormatted({ ctx, level: Level.Debug, message })
    }

    info(message: string, ctx?: unknown): void {
        this.emitFormatted({ ctx, level: Level.Info, message })
    }

    warn(message: string, ctx?: unknown): void {
        this.emitFormatted({ ctx, level: Level.Info, message })
    }

    getStack(err: Error): string {
        return err.stack as string
    }

    error(err: string | Error, ctx?: unknown): void {
        const error = err instanceof Error ? err : new Error(err)
        const message = error.toString()
        this.emitFormatted({
            ctx,
            level: Level.Error,
            message,
            prefix: `${this.getStack(error)}\n`
        })
    }

    protected format(options: ILoggerOptions): string {
        const { ctx, level, message } = options
        const { name } = this
        const prefix = options.prefix ?? ''
        const event = Logger.serialize({
            createdAt: new Date(),
            ctx,
            level,
            loggerName: name
        })
        return `${prefix}${message}: ${event}`
    }

    protected emitFormatted(options: ILoggerOptions): void {
        const { level } = options
        if (!this.shouldEmit(level)) return
        const formatted = this.format(options)
        this.emit(formatted, options)
    }

    protected shouldEmit(level: Level): boolean {
        return level >= this.level
    }

    abstract emit(formatted: string, options: ILoggerOptions): void
}

export class ConsoleLogger extends Logger {

    emit(formatted: string, options: ILoggerOptions): void {
        const { level } = options;

        switch(level) {
            case Level.Debug:
                console.debug(formatted)
                break
            case Level.Info:
                console.info()
                break
            case Level.Error:
                console.error(formatted)
                break
            case Level.Warn:
                console.warn(formatted)
                break
        }
    }
}