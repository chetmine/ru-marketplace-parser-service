const newman = require('newman');


const runCount = 10;
const runs = [];

for (let i = 0; i < runCount; i++) {
    runs.push(
        new Promise((resolve, reject) => {
            newman.run({
                collection: require('./collection.json'),
                reporters: 'cli',
                insecure: true,
            }, (err, summary) => {
                if (err) reject(err);
                else resolve(summary);
            });
        })
    );
}

Promise.all(runs)
    .then(results => {
        console.log('All requests completed!');
        console.log(`Total runs: ${results.length}`);
    })
    .catch(err => console.error('Error:', err));