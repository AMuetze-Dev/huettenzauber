FROM huettenzauber_frontend_deps:latest AS build
COPY . .
ENV REACT_APP_API_URL=/api
RUN npm run build

# Production-Stage
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/build .   
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]