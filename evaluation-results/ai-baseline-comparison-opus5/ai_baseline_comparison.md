# AI Baseline Comparison

Provider: anthropic | Model: claude-opus-5 | Runs per system: 5

| System | Model | Benchmark | F1 mean | F1 stdev | Precision mean | Recall mean | Exact-match rate | Mean pairwise Jaccard |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Cyclic dependencies | claude-opus-5 | `/Users/ilmeedesilva/MESA/benchmarks/ground_truth.yml` | 0.88 | 0.2683 | 0.9 | 0.8667 | 0.8 | 0.7 |
| God Service | claude-opus-5 | `/Users/ilmeedesilva/MESA/benchmarks/ground_truth.yml` | 0.5847 | 0.1236 | 0.96 | 0.4235 | 0.8 | 0.7778 |
| Spring Boot microservices sample (piomin/sample-spring-microservices-new) | claude-opus-5 | `/Users/ilmeedesilva/MESA/benchmarks/real_repo_spring_sample.yml` | 0.3897 | 0.0058 | 0.8857 | 0.25 | 0.8 | 0.9429 |
| Sock Shop (microservices-demo org - catalogue, carts, orders, payment, shipping, user, queue-master, front-end) | claude-opus-5 | `/Users/ilmeedesilva/MESA/benchmarks/real_repo_sockshop.yml` | 0.3867 | 0.0298 | 0.9 | 0.25 | 0.8 | 0.8 |
