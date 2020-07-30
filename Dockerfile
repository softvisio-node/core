FROM centos:latest

LABEL maintainer="zdm <zdm@softvisio.net>"

USER root

ENV TZ=UTC \
    WORKSPACE="/var/local"

WORKDIR $WORKSPACE

ADD . $WORSPACE/softvisio-core

SHELL [ "/bin/bash", "-l", "-c" ]

ONBUILD USER root
ONBUILD SHELL [ "/bin/bash", "-l", "-c" ]
ONBUILD ENV DIST_DIR="$WORKSPACE/dist"
ONBUILD WORKDIR $DIST_DIR/data
ONBUILD ADD . $DIST_DIR
ONBUILD ENTRYPOINT [ "/bin/bash", "-l", "-c", "node ../bin/main.js \"$@\"", "bash" ]

RUN \
    # setup host
    source <( curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-host.sh ) \
    \    \
    # setup node build environment
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- setup \
    \
    # install latest node
    && n latest \
    && n rm latest \
    && dnf clean all \
    \
    # setup node
    && npm config set prefix ~/.npm \
    && npm config set cache ~/.npm-cache \
    && npm config set better-sqlite3_binary_host "https://raw.githubusercontent.com/softvisio/node-prebuild/master/better-sqlite3" \
    && npm config set uws_binary_host "https://raw.githubusercontent.com/softvisio/node-prebuild/master/uws"
    # \
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-node.sh | /bin/bash \
    # \    \
    # cleanup node build environment
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- cleanup

ENTRYPOINT [ "/bin/bash", "-l" ]
