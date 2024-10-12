node_modules/:
		npm i

output.csv: node_modules/
	mkdir -p static/files/resume

.PHONY: clean
clean:
	-rm -rf output.csv output

.PHONY: input.csv
input.csv: node_modules/
	deno run --allow-read --allow-write --allow-net --allow-env --allow-run --allow-ffi main.ts

.PHONY: fix
fix:
	npx @renoirb/conventions-use-prettier -w *.ts
	npx @renoirb/conventions-use-prettier -w *.md
	npx sort-package-json

.DEFAULT: run
.PHONY: run
run: input.csv

