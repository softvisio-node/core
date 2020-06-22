FROM centos:latest

LABEL maintainer="zdm"

USER root

ENV TZ=UTC \
    WORKSPACE="/var/local"

WORKDIR $WORKSPACE

ADD . $WORSPACE/softvisio-core

SHELL [ "/bin/bash", "-l", "-c" ]

ONBUILD SHELL [ "/bin/bash", "-l", "-c" ]

RUN \
    # setup host
    source <( curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-host.sh ) \
    \    \
    # setup node build environment
    && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- setup \
    \
    # install latest node
    && n latest \
    \
    # setup node
    && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-node.sh | /bin/bash \
    \
    # pre-install @softvisio/core
    && pushd $WORSPACE/softvisio-core \
    && npm i --unsafe \
    && popd \
    && rm -rf $WORSPACE/softvisio-core \
    \
    # pre-install @softvisio/vue-ext
    && git clone https://bitbucket.org/softvisio/softvisio-vue-ext.git \
    && pushd softvisio-vue-ext \
    && npm i --unsafe \
    && popd \
    && rm -rf softvisio-vue-ext \
    \
    # pre-install app template
    && git clone https://bitbucket.org/softvisio/templates.git \
    && pushd templates/app-vue-ext \
    && npm i --unsafe \
    && popd \
    && rm -rf templates \
    \
    # cleanup node build environment
    && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- cleanup

ENTRYPOINT [ "/bin/bash", "-l" ]
