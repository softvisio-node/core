FROM centos:latest

USER root

ENV TZ=UTC

WORKDIR /var/local

SHELL [ "/bin/bash", "-l", "-c" ]

ONBUILD USER root
ONBUILD SHELL [ "/bin/bash", "-l", "-c" ]
ONBUILD WORKDIR /var/local/package
ONBUILD ADD . /var/local/package
ONBUILD ENTRYPOINT [ "/bin/bash", "-l", "-c", "node bin/main.js \"$@\"", "bash" ]
ONBUILD HEALTHCHECK \
    --start-period=30s \
    --interval=30s \
    --retries=3 \
    --timeout=10s \
    CMD curl -f http://127.0.0.1/api/ping || exit 1

RUN \
    # setup host
    source <( curl -fsSL https://bitbucket.org/softvisio/scripts/raw/main/setup-host.sh ) \
    \
    # setup node build environment
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/main/env-build-node.sh | /bin/bash -s -- setup \
    \
    # install latest node
    && n latest \
    && n rm latest \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    \
    # setup node
    && npm config set prefix ~/.npm \
    && npm config set cache ~/.npm-cache \
    && npm config set engine-strict true \
    \
    # make global node modules loadable
    && mkdir -p ~/.npm/lib \
    && rm -rf ~/.node_modules \
    && ln -s ~/.npm/lib/node_modules ~/.node_modules
    # \
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/main/setup-node.sh | /bin/bash \
    # \
    # cleanup node build environment
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/main/env-build-node.sh | /bin/bash -s -- cleanup

ENTRYPOINT [ "/bin/bash", "-l" ]
