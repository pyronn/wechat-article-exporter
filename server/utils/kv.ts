// In-memory KV implementation
class MemoryKV {
    private storage = new Map<string, any>();

    async get(key: any[]): Promise<{ value: any, versionstamp: string | null }> {
        const keyString = JSON.stringify(key);
        const value = this.storage.get(keyString);
        return {
            value: value || null,
            versionstamp: value ? new Date().toISOString() : null
        };
    }

    async set(key: any[], value: any): Promise<{ ok: boolean, versionstamp: string }> {
        const keyString = JSON.stringify(key);
        this.storage.set(keyString, value);
        return {
            ok: true,
            versionstamp: new Date().toISOString()
        };
    }

    async delete(key: any[]): Promise<{ ok: boolean, versionstamp: string }> {
        const keyString = JSON.stringify(key);
        const existed = this.storage.has(keyString);
        this.storage.delete(keyString);
        return {
            ok: existed,
            versionstamp: new Date().toISOString()
        };
    }

    atomic() {
        return new MemoryKVAtomic(this);
    }

    close() {
        // Nothing to close in memory implementation
    }
}

class MemoryKVAtomic {
    private operations: { type: 'check' | 'set' | 'delete', key: any[], value?: any, versionstamp?: string | null }[] = [];
    private kv: MemoryKV;

    constructor(kv: MemoryKV) {
        this.kv = kv;
    }

    check({ key, versionstamp }: { key: any[], versionstamp: string | null }): MemoryKVAtomic {
        this.operations.push({ type: 'check', key, versionstamp });
        return this;
    }

    set(key: any[], value: any): MemoryKVAtomic {
        this.operations.push({ type: 'set', key, value });
        return this;
    }

    delete(key: any[]): MemoryKVAtomic {
        this.operations.push({ type: 'delete', key });
        return this;
    }

    async commit(): Promise<{ ok: boolean, versionstamp: string }> {
        // Simple implementation: just execute operations in sequence
        // For a real atomic operation, we'd need more sophisticated locking/transaction logic
        
        try {
            for (const op of this.operations) {
                if (op.type === 'set') {
                    await this.kv.set(op.key, op.value);
                } else if (op.type === 'delete') {
                    await this.kv.delete(op.key);
                } else if (op.type === 'check') {
                    const { value, versionstamp } = await this.kv.get(op.key);
                    // For null check - if versionstamp is null, we're checking that key doesn't exist
                    if (op.versionstamp === null && value !== null) {
                        throw new Error(`Key already exists: ${JSON.stringify(op.key)}`);
                    }
                    // For existing key check
                    if (op.versionstamp !== null && value === null) {
                        throw new Error(`Key not found: ${JSON.stringify(op.key)}`);
                    }
                }
            }
            return { ok: true, versionstamp: new Date().toISOString() };
        } catch (error) {
            console.error('Atomic operation failed:', error);
            return { ok: false, versionstamp: new Date().toISOString() };
        }
    }
}

// Create a singleton memory KV instance
const memoryKV = new MemoryKV();

export const useKv = async () => {
    // Try to use Deno.openKv() if available
    if ((globalThis as any).Deno) {
        return (globalThis as any).Deno.openKv();
    }
    
    // Try to use @deno/kv in development if installed
    if (process.dev) {
        try {
            const OpenKV = () => import('@deno/kv');
            const { openKv } = await OpenKV();
            return openKv('');
        } catch (error) {
            console.warn('Deno KV module not available, using in-memory KV instead');
            return memoryKV;
        }
    }
    
    // In production or when Deno KV is not available, use in-memory KV
    console.info('Using in-memory KV storage');
    return memoryKV;
};
