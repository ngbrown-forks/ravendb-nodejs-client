import assert from "node:assert"
import { acquireSemaphore } from "../../src/Utility/SemaphoreUtil.js";
import { delay } from "../../src/Utility/PromiseUtil.js";
import { Semaphore } from "../../src/Utility/Semaphore.js";

describe("SemaphoreUtil", function () {

    let sem: Semaphore;

    beforeEach(function () {
        sem = new Semaphore();
    });

    it("should be able to acquire and release semaphore ", async () => {
        const semContext = acquireSemaphore(sem);
        await semContext.promise;
        semContext.dispose();
    });

    it("can timeout and try again", async () => {
        assert.ok(sem.available(1));

        const semContextLocked = acquireSemaphore(sem, {
            contextName: "LOCK" 
        });

        await semContextLocked.promise;
        assert.ok(!sem.available(1));
        
        const semContextTimingOut = acquireSemaphore(sem, {
            timeout: 100, 
            contextName: "SHOULD_TIMEOUT" 
        });

        assert.ok(!sem.available(1));

        try {
            await semContextTimingOut.promise;
        } catch (err) {
            assert.strictEqual(err.name, "TimeoutError");
            assert.ok(!sem.available(1));

            const secondSemAcqAttempt = acquireSemaphore(sem, {
                timeout: 1000,
                contextName: "SHOULD_NOT_TIMEOUT"
            });

            assert.ok(!sem.available(1));
            semContextLocked.dispose();
            
            await secondSemAcqAttempt.promise;

            secondSemAcqAttempt.dispose();

            return;
        }

        assert.fail("it should have timed out.");
    });

    it("should be able to acquire and release semaphore with multiple clients", async () => {
        const semContext = acquireSemaphore(sem, { contextName: "1" });
        const semContext2 = acquireSemaphore(sem, { contextName: "2" });
        const semContext3 = acquireSemaphore(sem, { contextName: "3" });

        async function semTryf(semContext, delayMs) {
            try {
                await semContext.promise;
                await delay(delayMs);
            } finally {
                semContext.dispose();
            }
        }

        await Promise.all([ 
            semTryf(semContext, 10), 
            semTryf(semContext2, 15),
            semTryf(semContext3, 5),
        ]);
    });
});
