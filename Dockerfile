FROM centos:latest

LABEL maintainer="zdm"

USER root

ENV TZ=UTC \
    WORKSPACE="/var/local"

WORKDIR $WORKSPACE

ADD . $WORSPACE/softvisio-core

SHELL [ "/bin/bash", "-l", "-c" ]

ONBUILD SHELL [ "/bin/bash", "-l", "-c" ]
ONBUILD ENV DIST_DIR="$WORKSPACE/dist"
ONBUILD WORKDIR $DIST_DIR/data

RUN \
    # setup host
    source <( curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-host.sh ) \
    \    \
    # setup node build environment
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- setup \
    \
    # install latest node
    && n latest \
    && dnf clean all
    # \
    # setup node
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-node.sh | /bin/bash \
    # \    \
    # cleanup node build environment
    # && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- cleanup

ENTRYPOINT [ "/bin/bash", "-l" ]
