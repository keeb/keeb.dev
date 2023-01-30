# Requirements

For a proper CI system, the following requirements are strictly necessary

Build on every commit, whether that's in a branch, or a commit on a branch, or a new branch, or a new pull request. **Any** activity the code should be able to be tested

CI process should be ingrained in the localbuild process. Meaning you're going to test the CI process before you actually commit the code.

The CI/CD process *itself* should be testable, deployable, and controllable.

Ideally, there's a remotely accessible? staging environment where the code can be integration tested, in addition to local testing.

YAML? Or any config vs. code. It's ok but it's going to be a hinderance

## Technology choices to be evaluated

### Traditional CI/CD tools ...

* Github Actions
* [Dagger.io](https://dagger.io)
* [Drone.io](https://drone.io)
* [Woodpecker](https://woodpecker-ci.org/) - Drone.io fork (MariaDB vs MySQL)
* [Buildkite](https://buildkite.com)
* [Jenkins](https://www.jenkins.io/)
* [Bamboo](https://www.atlassian.com/software/bamboo) 
* [GitLab](https://gitlab.com/gitlab-org/gitlab)
* [CircleCI](https://circleci.com/)
* [Cloudbees](https://www.cloudbees.com/products/codeship/overview)
* [Gocd](https://www.gocd.org/test-drive-gocd.html)
* [Harness](https://www.harness.io/)
* [Codefresh](https://codefresh.io/)
* [Octopus](https://www.octopus.com/)
* [Travis.ci](https://www.travis-ci.com/)


### Kube or maybe less applicable options
* [Argo](https://argoproj.github.io/)
* [Concourse](https://concourse-ci.org/)


### Maybe PaaS is enough?
* [Railway](https://railway.app)
* [Cycle.io](https://cycle.io)
* [Akash](https://akash.network) - crazy web3 idea maybe
* [Okteto](https://www.okteto.com/)
* [Jenkis-X](https://jenkins-x.io/)


### DIY Platform

* [screwdriver.cd](https://screwdriver.cd)
* [Spinnaker](https://spinnaker.io/)
* [Tekton](https://tekton.dev/)


### DIY - DIY

This is where we make our own, specific to our usecase.

# Notes

Did you know there is [cd.foundation?](https://landscape.cd.foundation/) - waow

# The plan 

* Evaluate the tools on the list
* Pick 5 candidates to do a PoC and learn
* Apply the criteria in the requirements to the tool
* Write up pros/cons of each
* Hopefully fall in love and end the experiment early
* But if not, either pick 5 more and repeat or *DIY*

