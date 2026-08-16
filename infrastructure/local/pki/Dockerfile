FROM alpine:3.22

RUN apk add --no-cache openssl
COPY pki.sh /usr/local/bin/map-pki
RUN sed -i 's/\r$//' /usr/local/bin/map-pki && chmod 0755 /usr/local/bin/map-pki

ENTRYPOINT ["map-pki"]
CMD ["generate"]
