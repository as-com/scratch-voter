FROM ascom/docker-node:6.2.0-onbuild

ENV NODE_ENV production

CMD ["node", "index.js"]