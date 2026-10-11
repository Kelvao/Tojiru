FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY locales/ /usr/share/nginx/html/locales/
COPY src/ /usr/share/nginx/html/src/
COPY vendor/ /usr/share/nginx/html/vendor/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

