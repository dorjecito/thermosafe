# Subscription security rules tests

These tests use the real Firestore rules emulator, the existing Firebase client
SDK for unauthenticated requests (as in the PWA), and Admin only to seed fixtures.
They load the repository's `firestore.rules` before running. They refuse remote
hosts and use only the fixed project `demo-thermosafe-rules`.

Start a Firestore emulator on localhost, then run:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run test:rules
```

For example, with the official Firestore emulator 1.19.8 and Java 17:

```sh
java -jar /tmp/thermosafe-firestore-emulator-1.19.8.jar --host 127.0.0.1 --port 8080 --project_id demo-thermosafe-rules
```

No production credentials, Firebase deployment or Cloud Functions are needed.
The tests cover client create/update separately, Admin field preservation,
reset payloads, nested map changes, field additions/deletions and invalid values.
The 15 km decision stays in the frontend; the rules constrain reset writes to
the exact existing reset payload and do not implement a second distance formula.
