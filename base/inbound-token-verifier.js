((
  config = JSON.decode(pipy.load('config-token-verifier.json')),
) =>
  pipy({
    _verifier: config.verifier,
    _authPath: config?.paths && config.paths?.length > 0 && (
      new algo.URLRouter(Object.fromEntries(config.paths.map(path => [path, true])))
    ),
    _authRequred: false,
    _authSuccess: undefined,
  })

    .import({
      _inService: 'inbound-http-routing',
    })

    .pipeline()
    .handleMessageStart(
      msg => _authRequred = (_verifier && _authPath?.find(msg.head.headers.host, msg.head.path))
    )
    .branch(
      () => _authRequred, (
      $ => $
        .fork().to($ => $
          .muxHTTP().to($ => $.connect(()=> _verifier))
          .handleMessageStart(
            msg => _authSuccess = (msg.head.status == 200)
          )
        )
        .wait(() => _authSuccess !== undefined)
        .branch(() => _authSuccess, $ => $.chain(),
          $ => $.replaceMessage(
            () => new Message({ status: 401 }, 'Unauthorized!')
          )
        )
    ),
      $ => $.chain()
    )
)()