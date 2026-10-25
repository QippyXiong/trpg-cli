"""Generated contract snapshot comes from npm trpg-protocol; never edit JSON by hand."""
import json
from pathlib import Path
CONTRACT=json.loads(Path(__file__).with_name('protocol.json').read_text(encoding='utf-8'))
VERSION=CONTRACT['version']
if not VERSION.startswith('0.1.'):raise RuntimeError('Unsupported protocol version; sync and update the client/server together')
ROUTES={k:v['path'] for k,v in CONTRACT['routes'].items()}
EVENT_LABELS={'action':'行动声明','chat':'闲聊','dice':'掷骰','settlement':'主持人结算','system':'桌面动态'}
API_PREFIX=CONTRACT['apiPrefix']

ERROR_CODES=CONTRACT['errorCodes']
