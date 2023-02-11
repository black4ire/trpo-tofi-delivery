# DEV
build-testimage:
	docker-compose build
migrate-local:
	docker exec -it $$(docker-compose ps -q api) python manage.py makemigrations;\
	docker exec -it $$(docker-compose ps -q api) python manage.py migrate
run-local:
	docker-compose up -d;\
	docker exec --tty $$(docker-compose ps -q api) \
		python -m gunicorn --bind 0.0.0.0:8000 --workers 4 config.wsgi:application &
stop-local:
	docker-compose down
test:
	docker-compose run api python -m pytest;\
	docker-compose down
lint:
	pre-commit run --all-files

