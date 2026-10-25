// Verify public release provenance before installation.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const pin=JSON.parse(readFileSync('protocol-release.json'));
const manifest=JSON.parse(readFileSync('package.json'));
const lock=JSON.parse(readFileSync('package-lock.json'));
const entry=lock.packages['node_modules/'+pin.package];
if(pin.package!=='@qippyxiong/trpg-protocol'||manifest.dependencies[pin.package]!==pin.url||entry.version!==pin.version||entry.resolved!==pin.url)throw Error('Release, manifest and lock disagree');
if(!pin.url.startsWith('https://github.com/QippyXiong/trpg-protocol/releases/download/v'+pin.version+'/'))throw Error('Unexpected release source');
const data=readFileSync(process.argv[2]||'protocol.tgz');
const sha256=createHash('sha256').update(data).digest('hex');
const integrity='sha512-'+createHash('sha512').update(data).digest('base64');
if(sha256!==pin.sha256||integrity!==pin.integrity||integrity!==entry.integrity)throw Error('Release artifact checksum mismatch');
console.log('Verified public release '+pin.version+' against manifest and lock');
