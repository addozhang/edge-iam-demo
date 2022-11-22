((
  config = JSON.decode(pipy.load('config-token-injector.json')),
) =>

  pipy({
    _authNs: config?.services && Object.fromEntries(
      Object.entries(config.services).map(
        ([k, v]) => [
          k,
          {
            token: v.token,
            paths: v.paths && v.paths.length > 0 ? (
              v.paths.forEach(path => console.log(path)),
              new algo.URLRouter(Object.fromEntries(v.paths.map(path => [path, true])))
            ) : new algo.URLRouter({ "/*": true }),
          }
        ]
      )
    ),
  })

    .import({
      _outService: 'outbound-http-routing',
    })

    .pipeline()
    .handleMessageStart(
      msg => (
        (service = _authNs?.[_outService]) => service && service?.paths?.find(msg.head.headers.host, msg.head.path) && (
          msg.head.headers['x-iam-token'] = service.token
        )
      )()
    )
    .chain()
)()