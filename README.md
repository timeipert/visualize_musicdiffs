# Visualize MusicDiff

How can digital methods help reduce the complexity that arises from differences among
multiple sources of a musical work? 
We present a web-based application designed to 
visualise differences between digital representations of various versions of musical texts.
This approach addresses challenges similar to those encountered in fields like
comparative genomics. 

## Visualisation Approaches
Our tool offers two visualisation methods: 

* a dynamic network
visualisation (Linhares et al. 2017), where nodes represent sources and edges represent
differences derived from pairwise diff files, and 

* a Neighbor Joining tree (Saitou & Nei
1987), which reconstructs a tree structure from a distance matrix. By aligning diff-files
(Hunt & MacIlroy 1976) sequentially, our tool visualises how and when changes occur
over time. 
  
Both visualisations display the relationship between sources at specific
moments, allowing users to trace divergence and convergence, potentially discovering
hints of contamination, and demonstrate how differences listed in musicdiff files
(Foscarin et al. 2019) can be explored intuitively. The (animated) dynamic network
approach is especially well-suited to illustrate temporal developments, while the
Neighbor Joining tree provides a clearer interpretation of distances. Each method thus
offers a different analytical perspective. 

By integrating both approaches into a single web
application, we are making them accessible for scholarly research and digital editions
alike. Beyond supporting established editorial tasks, we see particular potential in
evaluating large corpora of automatically generated transcriptions using Optical Music
Recognition (OMR) software. As digital editions increasingly rely on such automatic
processes, tools like ours are valuable for quickly assessing how much a new
transcription diverges from existing versions.

You can create the diff-files from multiple MEI-Files with the following colab:
[Google Colab Multiple MusicDiffs](https://colab.research.google.com/drive/1kpsOZ8GVcP6McCZPzv_YYDY9LeAWdqPU?usp=sharing)
Then you can find our app [here](https://timeipert.github.io/visualize_musicdiffs/).


Presented at Third International Conference on Computational and Cognitive Musicology
in Aalborg University, Denmark, 
8-10 October 2025. Poster: 
# Develop
If you want to deploy it yourself, you can clone the repository, 
then you should install dependencies with
```
npm install
```
and then can start the app with
```
npm run dev
```
## Other Links
You can also find this project on [OSF](https://osf.io/czmw8/).