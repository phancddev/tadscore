.PHONY: setup up down restart logs ps migrate account-create test build validate docker-format docker-lint docker-test docker-build docker-check docker-api-integration docker-playwright

setup:
	@test -f .env || cp .env.example .env
	@echo "Edit .env and replace all CHANGE_ME values, then run: make up"

up:
	docker compose up --build -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

migrate:
	docker compose run --rm migrate

account-create:
	./scripts/create-account.sh $(ARGS)

test:
	./scripts/docker-quality.sh unit

build:
	./scripts/docker-quality.sh build

validate:
	./scripts/docker-quality.sh lint
	docker compose --env-file .env.example config --quiet

docker-format:
	./scripts/docker-quality.sh format

docker-lint:
	./scripts/docker-quality.sh lint

docker-test:
	./scripts/docker-quality.sh unit

docker-build:
	./scripts/docker-quality.sh build

docker-check:
	./scripts/docker-quality.sh all

docker-api-integration:
	./scripts/docker-api-integration.sh

docker-playwright:
	./scripts/docker-playwright.sh
