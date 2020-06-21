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
    \
    # install commands
    && URL=https://bitbucket.org/softvisio/scripts/raw/master/node-docker \
    && pushd /usr/local/bin \
    && curl -fsSLO $URL/yarn-build && chmod +x yarn-build \
    && curl -fsSLO $URL/yarn-install && chmod +x yarn-install \
    && curl -fsSLO $URL/yarn-relink && chmod +x yarn-relink \
    && curl -fsSLO $URL/yarn-unlink && chmod +x yarn-unlink \
    && curl -fsSLO $URL/yarn-update && chmod +x yarn-update \
    && popd \
    \
    # setup node build environment
    && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- setup \
    \
    # install latest node
    && n latest \
    \
    # setup node
    && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/setup-node.sh | /bin/bash \
    \
    # install yarn config
    && curl -fsSLo ~/.yarnrc.yml $URL/.yarnrc.yml \
    \
    # pre-install @softvisio/core
    && pushd $WORSPACE/softvisio-core \
    && yarn-unlink \
    && yarn \
    && popd \
    && rm -rf $WORSPACE/softvisio-core \
    \
    # pre-install @softvisio/vue-ext
    && git clone https://bitbucket.org/softvisio/softvisio-vue-ext.git \
    && pushd softvisio-vue-ext \
    && yarn-unlink \
    && yarn \
    && popd \
    && rm -rf softvisio-vue-ext \
    \
    # cleanup node build environment
    && curl -fsSL https://bitbucket.org/softvisio/scripts/raw/master/env-build-node.sh | /bin/bash -s -- cleanup

ENTRYPOINT [ "/bin/bash", "-l" ]
