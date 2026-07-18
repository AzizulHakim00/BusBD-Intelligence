FROM nginx:1.27-alpine

ENV PORT=10000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY index.html /usr/share/nginx/html/index.html
COPY 404.html /usr/share/nginx/html/404.html
COPY favicon.svg /usr/share/nginx/html/favicon.svg
COPY assets /usr/share/nginx/html/assets

EXPOSE 10000

CMD ["nginx", "-g", "daemon off;"]
