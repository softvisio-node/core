# GET

```sh
curl \
    -H "Authorization:Bearer <YOUR-API-TOKEN>" \
    "http://devel/api/v1/tasks/create?key1=val1&key2=val2"
```

# POST

```sh
curl \
    -X POST \
    -H "Authorization:Bearer <YOUR-API-TOKEN>" \
    -H "Content-Type:application/json" \
    -d '{"key1":"val1","key2":"val2"}' \
    "http://devel/api/v1/tasks/create"
```

## Allowed conten types

- `application/json` (default);
- `application/msgpack`;
