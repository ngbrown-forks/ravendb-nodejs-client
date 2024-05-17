import { MigrationStatus } from "./MigrationStatus.js";

export interface ShardBucketMigration {
    status: MigrationStatus;
    bucket: number;
    sourceShard: number;
    destinationShard: number;
    migrationIndex: number;
    confirmationIndex: number;
    lastSourceChangeVector: string;

    confirmedDestinations: string[];
    confirmedSourceCleanup: string[];

    mentorNode: string;
}