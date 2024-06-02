
export class ClientShardHelper {
    public static toShardName(database: string, shardNumber: number): string {
        if (ClientShardHelper.isShardName(database)) {
            throw new Error("Expected a non shard name but got " + database);
        }

        if (shardNumber < 0) {
            throw new Error("Shard number must be non-negative");
        }

        return database + "$" + shardNumber;
    }

    public static toDatabaseName(shardName: string): string {
        const shardNumberPosition = shardName.indexOf("$");
        if (shardNumberPosition === -1) {
            return shardName;
        }

        return shardName.substring(0, shardNumberPosition);
    }

    public static tryGetShardNumberAndDatabaseName(databaseName: string): [string, number] | null {
        const index = databaseName.indexOf("$");
        let shardNumber = -1;
        let shardedDatabaseName: string;

        if (index !== -1) {
            const slice = databaseName.substring(index + 1);
            shardedDatabaseName = databaseName.substring(0, index);
            shardNumber = parseInt(slice, 10);

            return [shardedDatabaseName, shardNumber];
        }

        return null;
    }

    public static getShardNumberFromDatabaseName(databaseName: string): number {
        const result = ClientShardHelper.tryGetShardNumberAndDatabaseName(databaseName);
        return result ? result[1] : null;
    }

    public static isShardName(shardName: string): boolean {
        return shardName.includes("$");
    }
}
