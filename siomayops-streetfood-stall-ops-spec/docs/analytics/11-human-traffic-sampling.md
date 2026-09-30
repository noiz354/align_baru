# Page 11 analytics contract

**Status:** Implemented via the existing Pino structured logger. This is operational event logging, not a new analytics SDK.

| Event | Trigger | Allowed properties | Prohibited properties | Downstream use |
| --- | --- | --- | --- | --- |
| `traffic_sampling_page_viewed` | Successful authenticated page-data read | `page`, random `requestId`, `eventName` | operator/user/shift/location IDs, coordinates, media, notes, counts | coarse page reliability/usage only |
| `traffic_sample_started` | Explicit operator tap before camera permission is requested | page, random request ID, event name | identity/scope IDs, camera permission detail beyond safe enum, media | opt-in usage measurement |
| `traffic_sample_uploaded` | Server accepts a valid WebM payload | page, random request ID, `outcome`, byte-size, declared duration | bytes, filename, content hash, object key/URL, operator/shift/location IDs, exact count, note | upload success/size/duration reliability |
| `traffic_analysis_completed` | Manual count/band is persisted | page, random request ID, success outcome | exact result count, note, sample ID, operator/shift/location IDs, video ID | aggregate workflow completion only |
| `traffic_analysis_failed` | Capture, upload, or sample submission fails | page, random request ID, safe failure reason enum, failure outcome | exception text, user-entered values, media, operator/shift/location IDs | reliability and troubleshooting by failure class |

No event contains raw evidence, result counts, free text, user identity, shift/outlet identity, or direct media identifiers. The current Pino adapter writes structured logs; long-term analytics aggregation is intentionally not wired until privacy review approves a downstream use.
