//                             v        v       v
// roll your own god damn type every fucking time let's go
//                             ^        ^       ^   
export default class Queue {
    private last: Promise<void> = Promise.resolve();

    async do(fn: Function): Promise<any> {
        let isError = false;
        let returnValue: Function;
        const getValue = new Promise<any>((resolve) => returnValue = resolve);
        
        this.last = this.last.then(
            async () => {
                fn()
                .then(returnValue)
                .catch((error: any) => {
                    isError = true;
                    returnValue(error);
                });
            }
        );

        let value = await getValue;
        if (isError) throw value;
        return value;
    }
}
/*
class Queue {
    private inner: Array<Function> = [];

    async do(fn: Function): Promise<any> {
        let returnValue: Function;
        const getValue = new Promise<any>((resolve) => returnValue = resolve);
        
        this.inner.push(async () => {
            returnValue(await fn());

            this.inner.shift();
            console.log(`shifted function from queue, length ${this.inner.length}`);

            if (this.inner.length) this.inner[0]();
        });
        console.log(`pushed function to queue, length ${this.inner.length}`);

        if (this.inner.length == 1) this.inner[0]();

        return await getValue;
    }
}
*/